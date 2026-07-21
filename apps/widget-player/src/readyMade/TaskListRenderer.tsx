import { useEffect, useState } from 'react';
import type { TaskListComponent } from '@classroom-widgets/widget-spec';
import type { PlayerCopy } from '../localisation';

interface TaskListRendererProps {
  component: TaskListComponent;
  copy: PlayerCopy;
}

export function TaskListRenderer({ component, copy }: TaskListRendererProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setCompletedIds(new Set());
  }, [component]);

  function update(itemId: string, checked: boolean) {
    setCompletedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  return (
    <section className="ready-tool task-list-tool" aria-labelledby={`${component.id}-title`}>
      <h2 id={`${component.id}-title`}>{component.title}</h2>
      {component.showProgress ? (
        <p
          className="task-progress"
          role="status"
          aria-live="polite"
          aria-label={copy.taskProgress(completedIds.size, component.items.length)}
          lang={copy.locale}
        >
          {copy.taskProgress(completedIds.size, component.items.length)}
        </p>
      ) : null}
      <ul className="task-list">
        {component.items.map((item) => (
          <li key={item.id} data-complete={completedIds.has(item.id)}>
            <label>
              <input
                type="checkbox"
                checked={completedIds.has(item.id)}
                onChange={(event) => update(item.id, event.currentTarget.checked)}
              />
              <span>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        className="secondary-action"
        type="button"
        disabled={completedIds.size === 0}
        onClick={() => setCompletedIds(new Set())}
      >
        <span lang={copy.locale}>{copy.clearChecks}</span>
      </button>
    </section>
  );
}
