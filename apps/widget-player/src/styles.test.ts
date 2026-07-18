import styles from './styles.css?raw';

describe('student player motion', () => {
  it('removes non-essential motion when the student prefers reduced motion', () => {
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('animation-duration: 0.01ms');
  });
});
