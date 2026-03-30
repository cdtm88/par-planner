import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheSet, cacheGet, cacheRemove } from '../../src/storage/cache';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('cache', () => {
  beforeEach(() => {
    AsyncStorage.clear();
  });

  it('stores and retrieves a value', async () => {
    await cacheSet('test-key', { foo: 'bar' });
    const result = await cacheGet<{ foo: string }>('test-key');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('returns null for missing key', async () => {
    const result = await cacheGet('missing-key');
    expect(result).toBeNull();
  });

  it('removes a key', async () => {
    await cacheSet('to-remove', { data: 1 });
    await cacheRemove('to-remove');
    const result = await cacheGet('to-remove');
    expect(result).toBeNull();
  });
});
