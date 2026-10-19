import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ItemList from '../pages/ItemList';

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }));
import API from '../api/axios';

const item = (over = {}) => ({
  _id: 'i1', type: 'found', title: 'Black wallet', description: 'Near the cafeteria', category: 'Wallet',
  location: 'Cafeteria', imageUrl: '', status: 'Open', createdAt: new Date().toISOString(), postedBy: { name: 'Aman' }, ...over,
});
const page = (items, extra = {}) => ({ data: { items, total: items.length, page: 1, pages: 1, ...extra } });
const renderList = (route = '/items') => render(<MemoryRouter initialEntries={[route]}><ItemList /></MemoryRouter>);
const lastParams = () => API.get.mock.calls.at(-1)[1].params;

describe('ItemList', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  test('shows the items returned by the API with a result count', async () => {
    API.get.mockResolvedValue(page([item(), item({ _id: 'i2', title: 'Blue umbrella', type: 'lost' })]));
    renderList();
    expect(await screen.findByText('Black wallet')).toBeInTheDocument();
    expect(screen.getByText('Blue umbrella')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  test('does NOT send a status filter (the API only ever lists open items)', async () => {
    API.get.mockResolvedValue(page([item()]));
    renderList();
    await screen.findByText('Black wallet');
    expect(lastParams()).not.toHaveProperty('status');
    expect(API.get).toHaveBeenCalledWith('/items', expect.anything());
  });

  test('shows a helpful empty state', async () => {
    API.get.mockResolvedValue(page([]));
    renderList();
    expect(await screen.findByText('Nothing has been posted yet')).toBeInTheDocument();
  });

  test('shows an error state with a working retry', async () => {
    API.get.mockRejectedValueOnce({ response: { data: { message: 'Database unavailable' } } });
    const user = userEvent.setup();
    renderList();
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    API.get.mockResolvedValueOnce(page([item()]));
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('Black wallet')).toBeInTheDocument();
  });

  test('filters come from the URL, so a shared link restores the same view', async () => {
    API.get.mockResolvedValue(page([item()]));
    renderList('/items?type=found&category=Keys&q=red');
    await screen.findByText('Black wallet');
    expect(lastParams()).toMatchObject({ type: 'found', category: 'Keys', q: 'red' });
    expect(screen.getByLabelText('Search')).toHaveValue('red');
    expect(screen.getByRole('button', { name: 'Found' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('choosing a type applies it together with the other filters (search no longer drops them)', async () => {
    API.get.mockResolvedValue(page([item()]));
    const user = userEvent.setup();
    renderList('/items?q=wallet');
    await screen.findByText('Black wallet');
    await user.click(screen.getByRole('button', { name: 'Lost' }));
    await waitFor(() => expect(lastParams()).toMatchObject({ type: 'lost', q: 'wallet' }));
  });

  test('typing quickly sends one search request after the pause, not one per keystroke', async () => {
    API.get.mockResolvedValue(page([item()]));
    renderList();
    await screen.findByText('Black wallet');
    API.get.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByLabelText('Search'), 'keys');
    expect(API.get).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    await waitFor(() => expect(API.get).toHaveBeenCalledTimes(1));
    expect(lastParams()).toMatchObject({ q: 'keys' });
  });

  test('paginates: shows page controls and requests the next page', async () => {
    API.get.mockResolvedValue(page([item()], { total: 30, pages: 3 }));
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Page 1 of 3');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));
  });

  test('"Clear filters" resets everything', async () => {
    API.get.mockResolvedValue(page([item()]));
    const user = userEvent.setup();
    renderList('/items?type=lost&category=Keys');
    await screen.findByText('Black wallet');
    await user.click(screen.getAllByRole('button', { name: /Clear filters/ })[0]);
    // (axios omits params whose value is undefined)
    await waitFor(() => expect(lastParams().type).toBeUndefined());
    expect(lastParams().category).toBeUndefined();
  });
});
