import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StreakCard } from '../StreakCard';
import { ThemeProvider } from '../../theme/ThemeContext';
import type { Expense } from '../../types/expense';

function render(ui: React.ReactElement) {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('StreakCard', () => {
  it('renders nothing without a streak', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        render(<StreakCard streak={0} expenses={[]} />),
      );
    });
    expect(tree.toJSON()).toBeNull();
  });

  it('keeps working when the streak starts while it is on screen', async () => {
    // Regression: hooks after the early return crashed the app on 0 -> 1.
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        render(<StreakCard streak={0} expenses={[]} />),
      );
    });
    const expenses = [
      { id: 1, amount: 120, date: new Date().toISOString() } as Expense,
    ];
    await ReactTestRenderer.act(async () => {
      tree.update(render(<StreakCard streak={1} expenses={expenses} />));
    });
    expect(JSON.stringify(tree.toJSON())).toContain('día');
  });
});
