import {
  Component,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode
} from 'react';

class LoadBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        This section could not be loaded.{' '}
        <button type="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </p>
    ) : (
      this.props.children
    );
  }
}

export function DeferredContent<P extends object>({
  component: Content,
  componentProps,
  label,
  whenVisible = false
}: {
  component: ComponentType<P>;
  componentProps: P;
  label: string;
  whenVisible?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!whenVisible);
  useEffect(() => {
    if (!whenVisible || !container.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [whenVisible]);
  const placeholder = (
    <p className="deferred-note" role="status">
      {label}
    </p>
  );
  return (
    <div
      ref={container}
      className={whenVisible ? 'deferred-section' : undefined}
    >
      <LoadBoundary>
        <Suspense fallback={placeholder}>
          {visible ? <Content {...componentProps} /> : placeholder}
        </Suspense>
      </LoadBoundary>
    </div>
  );
}
