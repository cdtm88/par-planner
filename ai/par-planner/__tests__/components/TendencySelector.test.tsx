import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TendencySelector } from '../../src/components/TendencySelector';
import { ShotTendency } from '../../src/types';

describe('TendencySelector', () => {
  it('renders all tendency options', () => {
    const { getByText } = render(
      <TendencySelector selected="straight" onSelect={jest.fn()} />
    );
    expect(getByText('Straight')).toBeTruthy();
    expect(getByText('Slice')).toBeTruthy();
    expect(getByText('Hook')).toBeTruthy();
  });

  it('calls onSelect with the chosen tendency', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <TendencySelector selected="straight" onSelect={onSelect} />
    );
    fireEvent.press(getByText('Slice'));
    expect(onSelect).toHaveBeenCalledWith('slice');
  });

  it('highlights the selected tendency', () => {
    const { getByTestId } = render(
      <TendencySelector selected="draw" onSelect={jest.fn()} />
    );
    expect(getByTestId('tendency-draw-selected')).toBeTruthy();
  });
});
