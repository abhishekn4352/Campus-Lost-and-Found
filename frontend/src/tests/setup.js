import '@testing-library/jest-dom';

// React Router 6 prints v7 migration notices on every MemoryRouter render;
// App.jsx opts in to the flags, tests don't need the noise.
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) return;
  originalWarn(...args);
};
