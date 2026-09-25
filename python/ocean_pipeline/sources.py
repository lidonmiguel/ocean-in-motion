"""Explicit integration points. These functions perform no network access yet."""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SourcePlan:
    taxon_id: str
    scenario: str = "SSP2-4.5"
    target_year: int = 2050

    def __post_init__(self) -> None:
        if not self.taxon_id.strip():
            raise ValueError("A resolved taxon identifier is required")
        if self.scenario != "SSP2-4.5" or self.target_year != 2050:
            raise ValueError("The initial pipeline supports only SSP2-4.5 for 2050")


def stage_obis_occurrences(plan: SourcePlan, destination: Path) -> None:
    """TODO: scoped, versioned OBIS occurrence query and quality control.

    Resolve taxon identity, spatial/temporal filters, duplicates, sampling bias,
    licenses, source citations and a reproducible query before implementing.
    """
    raise NotImplementedError("OBIS integration awaits a scoped research protocol")


def stage_bio_oracle_environment(plan: SourcePlan, destination: Path) -> None:
    """TODO: select compatible Bio-ORACLE layers, periods, depth and scenario.

    Record layer versions, units, resolution and citations. Do not download a
    global archive or treat predictor grids as a fitted distribution model.
    """
    raise NotImplementedError("Bio-ORACLE integration awaits predictor selection")
