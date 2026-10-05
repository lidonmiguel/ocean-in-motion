"""Create standard scientific figures from reviewed forecast experiment artifacts."""
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[2]


def render():
    from .forecast import Panel
    panel = Panel()
    summary = json.loads((ROOT/'reports/temperature/metrics.json').read_text())
    plt.rcParams.update({'svg.hashsalt': 'ocean-forecast', 'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False})
    out = ROOT/'reports/temperature'
    figures = []
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), layout='constrained')
    ranking = summary['developmentRanking']
    axes[0].barh([r['id'] for r in ranking][::-1], [r['mae'] for r in ranking][::-1], color='#348b99')
    axes[0].set(xlabel='MAE (°C)', title='Model selection: development targets through 2014')
    horizons = np.arange(1, 6)
    axes[1].plot(horizons, [summary['byHorizon'][str(h)]['mae'] for h in horizons], 'o-', label='Selected model MAE')
    axes[1].plot(horizons, [summary['byHorizon'][str(h)]['radius'] for h in horizons], 'o--', label='Nominal 90% interval half-width')
    axes[1].set(xlabel='Forecast horizon (years)', ylabel='°C', title='Final test: origin 2020 → 2021–2025', xticks=horizons)
    axes[1].legend()
    figures.append(('model_comparison', fig))
    fig, ax = plt.subplots(figsize=(10, 5), layout='constrained')
    for area in ['med-west', 'atlantic-north', 'caspian', 'arctic']:
        values = np.array([panel.table[area][year] for year in panel.years])
        ax.plot(panel.years, values-values[0], label=panel.static[area]['name'])
    ax.set(xlabel='Year', ylabel='Change from 1982 regional value (°C)', title='Exploratory history · NOAA ERSSTv6 reconstructions')
    ax.legend()
    figures.append(('historical_trends', fig))
    fig, ax = plt.subplots(figsize=(10, 6), layout='constrained')
    items = sorted(summary['byArea'].items(), key=lambda item: item[1]['mae'])
    ax.barh([value['name'] for _, value in items], [value['mae'] for _, value in items], color='#348b99')
    ax.set(xlabel='MAE over five forecast years (°C)', title='Regional errors · untouched 2021–2025 test')
    figures.append(('regional_errors', fig))
    for name, fig in figures:
        svg = out/f'{name}.svg'
        fig.savefig(svg, metadata={'Date': None})
        svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
        fig.savefig(Path('/tmp')/f'{name}.png', dpi=140)
        plt.close(fig)


if __name__ == '__main__':
    render()
