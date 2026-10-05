"""Execute the analysis notebook with IPython, including real rich outputs.

Runs ordinary Python cells in one process without requiring Jupyter sockets.
Use after regenerating forecast artifacts and figures; fails on cell errors.
"""
from pathlib import Path

import nbformat
from IPython.core.interactiveshell import InteractiveShell
from IPython.utils.capture import capture_output

ROOT = Path(__file__).resolve().parents[2]


def execute(path=ROOT/'notebooks/temperature_forecasting.ipynb'):
    notebook = nbformat.read(path, as_version=4)
    shell = InteractiveShell.instance()
    count = 0
    for cell in notebook.cells:
        if cell.cell_type != 'code':
            continue
        count += 1
        with capture_output() as captured:
            result = shell.run_cell(cell.source, store_history=True)
        if result.error_before_exec or result.error_in_exec:
            raise RuntimeError(f'Notebook cell {count} failed: {captured.stdout}{captured.stderr}')
        cell.execution_count = count
        outputs = []
        if captured.stdout:
            outputs.append(nbformat.v4.new_output('stream', name='stdout', text=captured.stdout))
        if captured.stderr:
            outputs.append(nbformat.v4.new_output('stream', name='stderr', text=captured.stderr))
        for output in captured.outputs:
            outputs.append(nbformat.v4.new_output('display_data', data=output.data, metadata=output.metadata))
        cell.outputs = outputs
    nbformat.validate(notebook)
    nbformat.write(notebook, path)
    print(f'Executed {count} notebook cells: {path.name}')


if __name__ == '__main__':
    execute()
