import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BagBuilder } from '../../src/components/BagBuilder';
import { DEFAULT_BAG, EXTRA_CLUBS } from '../../src/constants/clubs';

describe('BagBuilder', () => {
  it('renders all default clubs', () => {
    const { getByText } = render(
      <BagBuilder bag={DEFAULT_BAG} onToggle={jest.fn()} onSetDistance={jest.fn()} />
    );
    expect(getByText('Driver')).toBeTruthy();
    expect(getByText('Putter')).toBeTruthy();
  });

  it('calls onToggle when a club is pressed', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <BagBuilder bag={DEFAULT_BAG} onToggle={onToggle} onSetDistance={jest.fn()} />
    );
    fireEvent.press(getByTestId('club-toggle-driver'));
    expect(onToggle).toHaveBeenCalledWith('driver');
  });

  it('calls onSetDistance when distance is entered', () => {
    const onSetDistance = jest.fn();
    const { getByTestId } = render(
      <BagBuilder bag={DEFAULT_BAG} onToggle={jest.fn()} onSetDistance={onSetDistance} />
    );
    fireEvent.changeText(getByTestId('club-distance-driver'), '250');
    expect(onSetDistance).toHaveBeenCalledWith('driver', 250);
  });

  it('shows selected clubs with a visual indicator', () => {
    const { getByTestId } = render(
      <BagBuilder bag={DEFAULT_BAG} onToggle={jest.fn()} onSetDistance={jest.fn()} />
    );
    // Driver is selected by default
    expect(getByTestId('club-selected-driver')).toBeTruthy();
  });
});
