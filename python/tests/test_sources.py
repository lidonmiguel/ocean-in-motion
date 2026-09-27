import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ocean_pipeline.sources import SourcePlan, stage_bio_oracle_environment, stage_obis_occurrences


def plan(max_records=3):
    return SourcePlan("123", (-20, 10, -10, 20), "2000-01-01", "2010-12-31", max_records)


def record(identifier, lon=-15, lat=15, **extra):
    return {"id": identifier, "decimalLongitude": lon, "decimalLatitude": lat,
            "dataset_id": "dataset-1", "license": "CC BY 4.0", "modified": "2024-01-01", **extra}


class Response(io.BytesIO):
    def __init__(self, payload):
        super().__init__(json.dumps(payload).encode())
        self.headers = {"ETag": '"revision-1"'}


class SourcePlanTests(unittest.TestCase):
    def test_required_scope_and_limit_validation(self):
        with self.assertRaises(TypeError):
            SourcePlan("123")
        for kwargs in (
            {"taxon_id": " "}, {"taxon_id": "abc"}, {"bounds": (-181, 0, 10, 20)},
            {"bounds": (20, 0, 10, 20)}, {"bounds": (-20, 10, -10, float("nan"))},
            {"start_date": "2000-02-30"}, {"end_date": "1999-01-01"},
            {"max_records": 0}, {"max_records": 10001}, {"max_records": True},
            {"scenario": "SSP5-8.5"},
            {"dataset_id": "not-a-uuid"},
        ):
            values = dict(taxon_id="123", bounds=(-20, 10, -10, 20),
                          start_date="2000-01-01", end_date="2010-12-31", max_records=2)
            values.update(kwargs)
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                SourcePlan(**values)

    def test_bio_oracle_is_still_unimplemented(self):
        with self.assertRaises(NotImplementedError):
            stage_bio_oracle_environment(plan(), Path("unused"))


class OccurrenceTests(unittest.TestCase):
    def stage(self, responses, source_plan=None):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        extract, manifest = Path(directory.name) / "extract.jsonl", Path(directory.name) / "manifest.json"
        calls = []

        def fake_open(request, timeout):
            calls.append((request.full_url, timeout))
            response = responses[len(calls) - 1]
            if isinstance(response, Exception):
                raise response
            return Response(response)

        with patch("ocean_pipeline.sources.urlopen", side_effect=fake_open):
            result = stage_obis_occurrences(source_plan or plan(), extract, manifest)
        return result, extract, manifest, calls

    def test_query_cap_and_manifest(self):
        result, extract, manifest, calls = self.stage([
            {"total": 10, "results": [record("a"), record("b"), record("c")]}
        ])
        self.assertEqual(len(calls), 1)
        query = parse_qs(urlparse(calls[0][0]).query)
        self.assertEqual(urlparse(calls[0][0]).path, "/v3/occurrence")
        self.assertEqual(query, {
            "taxonid": ["123"],
            "geometry": ["POLYGON((-20 10,-10 10,-10 20,-20 20,-20 10))"],
            "startdate": ["2000-01-01"], "enddate": ["2010-12-31"],
            "size": ["3"],
        })
        self.assertEqual(calls[0][1], 30)
        self.assertEqual(result["counts"]["raw_fetched"], 3)
        self.assertTrue(result["truncated_by_cap"])
        self.assertEqual(result["source"]["response_headers"][0]["ETag"], '"revision-1"')
        self.assertEqual(result["attribution"]["datasets"][0]["license"], ["CC BY 4.0"])
        self.assertEqual(json.loads(manifest.read_text()), result)
        self.assertEqual(len(extract.read_text().splitlines()), 3)
        with self.assertRaises(FileExistsError):
            stage_obis_occurrences(plan(), extract, manifest)

    def test_pagination_uses_last_occurrence_id_and_remaining_cap(self):
        first = [record(str(i)) for i in range(200)]
        result, _, _, calls = self.stage([
            {"total": 500, "results": first},
            {"total": 500, "results": [record("200"), record("201")]},
        ], plan(202))
        self.assertEqual([parse_qs(urlparse(url).query).get("after") for url, _ in calls], [None, ["199"]])
        self.assertEqual([parse_qs(urlparse(url).query)["size"][0] for url, _ in calls], ["200", "2"])
        self.assertEqual(result["counts"]["written"], 202)
        self.assertTrue(result["truncated_by_cap"])

    def test_dataset_filter_is_recorded(self):
        scoped = SourcePlan("123", (-20, 10, -10, 20), "2000-01-01", "2010-12-31", 1,
                            dataset_id="b9bfb219-1d5c-450e-9b26-fd377aee8561")
        result, _, _, calls = self.stage([{"total": 1, "results": [record("a")]}], scoped)
        self.assertEqual(parse_qs(urlparse(calls[0][0]).query)["datasetid"], [scoped.dataset_id])
        self.assertEqual(result["query"]["datasetid"], scoped.dataset_id)

    def test_coordinate_qc_and_duplicate_ids(self):
        rows = [
            record("a", occurrenceID="same"), record("a"), record("b", lon=-15),  # same position can be independent
            record("outside", lon=-9), record("bad", lat=91),
            record("missing", lon=None), record("bool", lon=True),
            {"decimalLongitude": -15, "decimalLatitude": 15},
            {"decimalLongitude": -15, "decimalLatitude": 15},
            {"decimalLongitude": -15, "decimalLatitude": 15, "dataset_id": "x", "occurrenceID": "o"},
            {"decimalLongitude": -15, "decimalLatitude": 15, "dataset_id": "x", "occurrenceID": "o"},
            record("new-id", occurrenceID="same"),  # distinct OBIS id, same provider identity
        ]
        result, extract, _, _ = self.stage([{"total": 12, "results": rows}], plan(12))
        self.assertEqual(result["counts"]["invalid_coordinates_or_outside_bounds"], 4)
        self.assertEqual(result["counts"]["after_coordinate_qc"], 8)
        self.assertEqual(result["counts"]["duplicate_identifiers"], 3)
        self.assertEqual(result["counts"]["without_duplicate_identifier"], 2)
        self.assertEqual(result["counts"]["written"], 5)
        self.assertEqual(len(extract.read_text().splitlines()), 5)

    def test_http_and_malformed_response_do_not_write(self):
        for response in (
            HTTPError("https://api.obis.org/v3/occurrence", 503, "Unavailable", {}, None),
            {"unexpected": []},
            {"total": 2, "results": [record("a")]},
            {"total": 1, "results": [record("a"), record("b")]},
        ):
            with self.subTest(response=response), tempfile.TemporaryDirectory() as directory:
                extract, manifest = Path(directory) / "x.jsonl", Path(directory) / "m.json"
                with patch("ocean_pipeline.sources.urlopen", side_effect=(
                    response if isinstance(response, Exception) else lambda *args, **kwargs: Response(response)
                )):
                    with self.assertRaises(RuntimeError):
                        stage_obis_occurrences(plan(3), extract, manifest)
                self.assertFalse(extract.exists())
                self.assertFalse(manifest.exists())

    def test_later_page_http_failure_leaves_no_partial_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            extract, manifest = Path(directory) / "x.jsonl", Path(directory) / "m.json"
            with patch("ocean_pipeline.sources.urlopen", side_effect=[
                Response({"total": 201, "results": [record(str(i)) for i in range(200)]}),
                HTTPError("https://api.obis.org/v3/occurrence", 429, "Rate limit", {}, None),
            ]):
                with self.assertRaises(RuntimeError):
                    stage_obis_occurrences(plan(201), extract, manifest)
            self.assertFalse(extract.exists())
            self.assertFalse(manifest.exists())

    def test_short_page_without_total_is_complete(self):
        result, _, _, calls = self.stage([{"results": [record("a")]}])
        self.assertEqual(len(calls), 1)
        self.assertIsNone(result["counts"]["api_total_reported"])
        self.assertFalse(result["truncated_by_cap"])


if __name__ == "__main__":
    unittest.main()
