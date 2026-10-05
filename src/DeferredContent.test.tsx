// @vitest-environment jsdom
import { lazy, useState } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeferredContent } from './DeferredContent';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('deferred sections', () => {
  it('waits for viewport proximity, keeps current props and disconnects the observer', async () => {
    const load = vi.fn(async () => ({
      default: ({ year }: { year: number }) => <p>Comparison {year}</p>
    }));
    const Content = lazy(load);
    let notify!: IntersectionObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback;
        }
        observe() {}
        disconnect = disconnect;
      }
    );
    const view = render(
      <DeferredContent
        component={Content}
        componentProps={{ year: 2025 }}
        whenVisible
        label="Comparison pending"
      />
    );
    expect(load).not.toHaveBeenCalled();
    view.rerender(
      <DeferredContent
        component={Content}
        componentProps={{ year: 2030 }}
        whenVisible
        label="Comparison pending"
      />
    );
    await act(async () =>
      notify(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    );
    await waitFor(() =>
      expect(screen.getByText('Comparison 2030')).toBeDefined()
    );
    expect(load).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalled();
  });

  it('does not reset loaded component state when its props change', async () => {
    function Counter({ year }: { year: number }) {
      const [count, setCount] = useState(0);
      return (
        <button onClick={() => setCount((value) => value + 1)}>
          {year} clicks {count}
        </button>
      );
    }
    const Content = lazy(async () => ({ default: Counter }));
    const view = render(
      <DeferredContent
        component={Content}
        componentProps={{ year: 2025 }}
        label="Loading"
      />
    );
    const button = await screen.findByRole('button');
    fireEvent.click(button);
    view.rerender(
      <DeferredContent
        component={Content}
        componentProps={{ year: 2030 }}
        label="Loading"
      />
    );
    expect(screen.getByText('2030 clicks 1')).toBeDefined();
  });

  it('loads the section when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const Content = lazy(async () => ({
      default: () => <p>Comparison available</p>
    }));
    render(
      <DeferredContent
        component={Content}
        componentProps={{}}
        whenVisible
        label="Pending"
      />
    );
    expect(await screen.findByText('Comparison available')).toBeDefined();
  });
});
