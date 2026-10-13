import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ItemList from '../pages/ItemList';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn() },
}));
import API from '../api/axios';

function renderItemList() {
  return render(
    <MemoryRouter>
      <ItemList />
    </MemoryRouter>
  );
}

describe('ItemList (regression test for the status="active" browse bug)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches /items without an incorrect status="active" param', async () => {
    API.get.mockResolvedValue({ data: [] });
    renderItemList();

    await waitFor(() => expect(API.get).toHaveBeenCalled());
    const [url, config] = API.get.mock.calls[0];
    expect(url).toBe('/items');
    // The bug was sending status: 'active', which the backend enum never
    // matches. It must not be present at all now — the backend applies
    // the correct Open filter itself.
    expect(config.params).not.toHaveProperty('status');
  });

  test('shows items returned from the API', async () => {
    API.get.mockResolvedValue({
      data: [
        { _id: '1', title: 'Blue Backpack', type: 'lost', category: 'Other', status: 'Open' },
        { _id: '2', title: 'Student ID Card', type: 'found', category: 'ID Card', status: 'Open' },
      ],
    });

    renderItemList();

    await waitFor(() => expect(screen.getByText('Blue Backpack')).toBeInTheDocument());
    expect(screen.getByText('Student ID Card')).toBeInTheDocument();
  });

  test('shows the empty state when no items are returned', async () => {
    API.get.mockResolvedValue({ data: [] });
    renderItemList();

    await waitFor(() => expect(screen.getByText('No Items Found')).toBeInTheDocument());
  });
});

describe('ItemList search debouncing (regression test for the one-request-per-keystroke bug)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('typing several characters quickly fires only one search request, after the pause', async () => {
    API.get.mockResolvedValue({ data: [] });
    renderItemList();

    // Let the initial (empty-search) /items load settle first.
    await act(async () => { await vi.waitFor(() => expect(API.get).toHaveBeenCalledTimes(1)); });
    API.get.mockClear();

    const input = screen.getByPlaceholderText('Search items…');
    // Simulate fast typing — each keystroke changes the value, but none
    // of them should individually trigger a request.
    fireEvent.change(input, { target: { value: 'w' } });
    fireEvent.change(input, { target: { value: 'wa' } });
    fireEvent.change(input, { target: { value: 'wal' } });
    fireEvent.change(input, { target: { value: 'wallet' } });

    // Still within the debounce window — no request yet.
    expect(API.get).not.toHaveBeenCalled();

    // Advance past the debounce window.
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });

    // Exactly one request, for the final value only.
    expect(API.get).toHaveBeenCalledTimes(1);
    expect(API.get).toHaveBeenCalledWith('/items/search?q=wallet', { params: {} });
  });

  test('clearing the search box refreshes results immediately, without waiting for the debounce', async () => {
    API.get.mockResolvedValue({ data: [] });
    renderItemList();
    await act(async () => { await vi.waitFor(() => expect(API.get).toHaveBeenCalledTimes(1)); });

    const input = screen.getByPlaceholderText('Search items…');
    fireEvent.change(input, { target: { value: 'wallet' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    API.get.mockClear();

    fireEvent.click(screen.getByText('✕'));

    // No debounce wait needed for an explicit clear — the very next
    // microtask flush should already show the request for all items.
    await act(async () => {
      await vi.waitFor(() => expect(API.get).toHaveBeenCalledWith('/items', { params: { type: '', category: '' } }));
    });
  });
});
