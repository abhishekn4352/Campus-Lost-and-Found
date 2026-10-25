import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EditItem from '../pages/EditItem';
import PostItem from '../pages/PostItem';

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
import API from '../api/axios';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => mockNavigate }));
let currentUser = { _id: 'owner' };
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: currentUser }) }));
const mockToast = vi.fn();
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));

const item = (over = {}) => ({
  _id: 'i1', type: 'found', title: 'Black wallet', description: 'Green sticker on the back.', category: 'Wallet', location: 'Cafeteria',
  imageUrl: '/uploads/w.png', status: 'Open', lostFoundDate: '2026-10-10T08:00:00.000Z', postedBy: { _id: 'owner', name: 'Aman' }, ...over,
});
const renderEdit = () => render(
  <MemoryRouter initialEntries={['/items/i1/edit']}><Routes><Route path="/items/:id/edit" element={<EditItem />} /></Routes></MemoryRouter>
);

describe('EditItem', () => {
  beforeEach(() => { vi.clearAllMocks(); currentUser = { _id: 'owner' }; });

  test('pre-fills the form from the post and fixes the type', async () => {
    API.get.mockResolvedValue({ data: item() });
    renderEdit();
    expect(await screen.findByLabelText('Title')).toHaveValue('Black wallet');
    expect(screen.getByLabelText('Description')).toHaveValue('Green sticker on the back.');
    expect(screen.getByLabelText('Category')).toHaveValue('Wallet');
    expect(screen.getByLabelText('Where did you find it?')).toHaveValue('Cafeteria');
    expect(screen.getByText(/type can’t be changed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'I lost something' })).not.toBeInTheDocument();
    expect(screen.getByAltText('Selected photo')).toBeInTheDocument();
  });

  test('saving sends the changed fields as multipart (never the type) and returns to the post', async () => {
    API.get.mockResolvedValue({ data: item() });
    API.put.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderEdit();
    const title = await screen.findByLabelText('Title');
    await user.clear(title);
    await user.type(title, '  Black leather wallet  ');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(API.put).toHaveBeenCalledTimes(1));
    const [url, fd] = API.put.mock.calls[0];
    expect(url).toBe('/items/i1');
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('title')).toBe('Black leather wallet');
    expect(fd.get('location')).toBe('Cafeteria');
    expect(fd.has('type')).toBe(false);
    expect(fd.has('removeImage')).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('/items/i1');
  });

  test('removing the current photo is sent as removeImage', async () => {
    API.get.mockResolvedValue({ data: item() });
    API.put.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderEdit();
    await user.click(await screen.findByRole('button', { name: 'Remove photo' }));
    expect(screen.getByRole('button', { name: /Keep the current photo/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(API.put).toHaveBeenCalled());
    expect(API.put.mock.calls[0][1].get('removeImage')).toBe('true');
  });

  test('validation blocks an invalid edit without calling the API', async () => {
    API.get.mockResolvedValue({ data: item() });
    const user = userEvent.setup();
    renderEdit();
    const title = await screen.findByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'ab');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/at least 3 characters/)).toBeInTheDocument();
    expect(API.put).not.toHaveBeenCalled();
  });

  test('shows the server error and stays on the page when saving fails', async () => {
    API.get.mockResolvedValue({ data: item() });
    API.put.mockRejectedValue({ response: { data: { message: 'Closed posts can’t be edited.' } } });
    const user = userEvent.setup();
    renderEdit();
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Closed posts can’t be edited.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('someone else’s post cannot be edited', async () => {
    currentUser = { _id: 'stranger' };
    API.get.mockResolvedValue({ data: item() });
    renderEdit();
    expect(await screen.findByText('You can only edit your own posts')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  test('a closed post cannot be edited', async () => {
    API.get.mockResolvedValue({ data: item({ status: 'Closed' }) });
    renderEdit();
    expect(await screen.findByText('Closed posts can’t be edited')).toBeInTheDocument();
  });
});

describe('PostItem (create) uses the same form', () => {
  beforeEach(() => vi.clearAllMocks());

  test('requires the fields, then posts multipart including the type and opens the new post', async () => {
    API.post.mockResolvedValue({ data: { _id: 'new1' } });
    const user = userEvent.setup();
    render(<MemoryRouter><PostItem /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Post lost item' }));
    expect(await screen.findByText(/at least 3 characters/)).toBeInTheDocument();
    expect(API.post).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Title'), 'Blue umbrella');
    await user.type(screen.getByLabelText('Description'), 'Large blue umbrella with a wooden handle.');
    await user.selectOptions(screen.getByLabelText('Category'), 'Other');
    await user.type(screen.getByLabelText('Where did you lose it?'), 'Library');
    await user.click(screen.getByRole('button', { name: 'Post lost item' }));

    await waitFor(() => expect(API.post).toHaveBeenCalledTimes(1));
    const [url, fd] = API.post.mock.calls[0];
    expect(url).toBe('/items');
    expect(fd.get('type')).toBe('lost');
    expect(fd.get('title')).toBe('Blue umbrella');
    expect(mockNavigate).toHaveBeenCalledWith('/items/new1');
  });

  test('switching to "I found something" changes the type that is posted', async () => {
    API.post.mockResolvedValue({ data: { _id: 'new2' } });
    const user = userEvent.setup();
    render(<MemoryRouter><PostItem /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'I found something' }));
    await user.type(screen.getByLabelText('Title'), 'Set of keys');
    await user.type(screen.getByLabelText('Description'), 'Three keys on a steel ring.');
    await user.selectOptions(screen.getByLabelText('Category'), 'Keys');
    await user.type(screen.getByLabelText('Where did you find it?'), 'Bench');
    await user.click(screen.getByRole('button', { name: 'Post found item' }));
    await waitFor(() => expect(API.post).toHaveBeenCalled());
    expect(API.post.mock.calls[0][1].get('type')).toBe('found');
  });
});
