/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  // Async act lets the start-up effects (theme, database, stores) settle.
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
  });
});
