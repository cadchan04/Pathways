import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EditTrip from '../EditTrip';
import { getTripById, updateTrip } from '../../../services/tripServices';
import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock services
vi.mock('../../../services/tripServices', () => ({
  getTripById: vi.fn(),
  updateTrip: vi.fn(),
  deleteTrip: vi.fn(),
  duplicateTrip: vi.fn(),
}));

// Mock trip for testing
const mockTrip = {
    _id: '123',
    name: 'Existing Trip',
    description: 'Old Description',
    startDate: '2026-03-01',
    endDate: '2026-03-05',
    budget: 500
};

describe('EditTrip Component', () => {
    beforeEach(() => {
        vi.clearAllMocks(); // clear mocks before each test

        getTripById.mockResolvedValue(mockTrip); // use direct function name
    });

    test('loads and displays existing trip data', async () => {
        render(
            <MemoryRouter initialEntries={['/edit-trip/123']}>
                <Routes>
                    <Route path="/edit-trip/:id" element={<EditTrip />} />
                </Routes>
            </MemoryRouter>
        );

        // check if input value matches mock data
        const nameInput = await screen.findByDisplayValue('Existing Trip');
        expect(nameInput).toBeInTheDocument();
    });

    test('updates trip details on submit', async () => {
        updateTrip.mockResolvedValue({ success: true });
        
        render(
            <MemoryRouter initialEntries={['/edit-trip/123']}>
                <Routes>
                    <Route path="/edit-trip/:id" element={<EditTrip />} />
                </Routes>
            </MemoryRouter>
        );

        const nameInput = await screen.findByDisplayValue('Existing Trip');

        // simulate user typing
        fireEvent.change(nameInput, { target: { value: 'Updated Trip Name' } });

        // simulate clicking save
        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(updateTrip).toHaveBeenCalledWith('123', expect.objectContaining({
                name: 'Updated Trip Name',
                description: 'Old Description',
                startDate: '2026-03-01',
                endDate: '2026-03-05',
                budget: 500
            }));
        });
    });
});