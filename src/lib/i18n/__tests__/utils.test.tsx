import { I18nManager, NativeModules, Platform } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';
import RNRestart from 'react-native-restart';

import { storage } from '@/lib/storage';
import { act, renderHook } from '@/lib/test-utils';

import i18n from '../index';
import {
  changeLanguage,
  getLanguage,
  translate,
  useSelectedLanguage,
} from '../utils';

jest.mock('react-native-restart', () => ({
  __esModule: true,
  default: { restart: jest.fn() },
}));

const originalPlatform = Platform.OS;
const originalDev = __DEV__;

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
}

function setDev(value: boolean) {
  Object.defineProperty(globalThis, '__DEV__', {
    configurable: true,
    value,
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  setPlatform(originalPlatform);
  setDev(originalDev);
  await i18n.changeLanguage('en');
});

afterAll(() => {
  setPlatform(originalPlatform);
  setDev(originalDev);
});

describe('i18n utilities', () => {
  it('reads the selected language from durable storage', () => {
    jest.spyOn(storage, 'getString').mockReturnValueOnce('ar');

    expect(getLanguage()).toBe('ar');
  });

  it('translates with options and reuses an equivalent memoized result', () => {
    const translateCall = jest.spyOn(i18n, 't');

    expect(translate('feed.title')).toBe('Feed');
    expect(translate('settings.title', { lng: 'ar' })).toBe('إعدادات');
    expect(translate('settings.title', { lng: 'ar' })).toBe('إعدادات');
    expect(translateCall).toHaveBeenCalledTimes(2);
  });

  it('persists a language selected through the hook', () => {
    setPlatform('windows');
    const persist = jest.fn();
    const forceRTL = jest.spyOn(I18nManager, 'forceRTL');
    jest.mocked(useMMKVString).mockReturnValueOnce(['en', persist]);
    const { result } = renderHook(useSelectedLanguage);

    act(() => result.current.setLanguage('ar'));

    expect(result.current.language).toBe('en');
    expect(persist).toHaveBeenCalledWith('ar');
    expect(forceRTL).toHaveBeenCalledWith(true);
  });

  it('enables RTL for Arabic and disables it for English', () => {
    setPlatform('windows');
    const forceRTL = jest.spyOn(I18nManager, 'forceRTL');

    changeLanguage('ar');
    changeLanguage('en');

    expect(forceRTL).toHaveBeenNthCalledWith(1, true);
    expect(forceRTL).toHaveBeenNthCalledWith(2, false);
  });

  it('reloads through native DevSettings in development', () => {
    setPlatform('ios');
    setDev(true);
    const reload = jest.fn();
    NativeModules.DevSettings = { reload };

    changeLanguage('en');

    expect(reload).toHaveBeenCalledTimes(1);
    expect(RNRestart.restart).not.toHaveBeenCalled();
  });

  it('restarts the native app in production', () => {
    setPlatform('android');
    setDev(false);
    NativeModules.DevSettings = { reload: jest.fn() };

    changeLanguage('en');

    expect(RNRestart.restart).toHaveBeenCalledTimes(1);
    expect(NativeModules.DevSettings.reload).not.toHaveBeenCalled();
  });

  it('reloads the browser when the web language changes', () => {
    setPlatform('web');
    const reload = jest.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload },
    });

    changeLanguage('en');

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
