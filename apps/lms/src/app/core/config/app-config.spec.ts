import { TestBed } from '@angular/core/testing';
import { environment as development } from '../../../environments/environment';
import { environment as production } from '../../../environments/environment.production';
import { environment as staging } from '../../../environments/environment.staging';
import {
  APP_CONFIG,
  AppConfigSchema,
  provideAppConfig,
  type AppConfigInput,
} from './app-config';

const valid: AppConfigInput = {
  name: 'development',
  production: false,
  apiBaseUrl: '',
  mockScenarios: true,
  devTools: true,
};

describe('AppConfig', () => {
  it.each([
    ['development', development],
    ['staging', staging],
    ['production', production],
  ])('accepts the %s environment file', (_name, env) => {
    expect(AppConfigSchema.safeParse(env).success).toBe(true);
  });

  it.each([
    ['development', development, true],
    ['staging', staging, true],
    ['production', production, false],
  ])('sets devTools for the %s environment', (_name, env, expected) => {
    expect(AppConfigSchema.parse(env).devTools).toBe(expected);
  });

  it('requires devTools', () => {
    const withoutDevTools: Partial<AppConfigInput> = { ...valid };
    delete withoutDevTools.devTools;
    expect(AppConfigSchema.safeParse(withoutDevTools).success).toBe(false);
  });

  it('accepts an https origin as apiBaseUrl', () => {
    expect(
      AppConfigSchema.safeParse({
        ...valid,
        apiBaseUrl: 'https://api.example.test',
      }).success,
    ).toBe(true);
  });

  it.each([
    'api.example.test',
    'ftp://api.example.test',
    'https://api.example.test/',
  ])('rejects apiBaseUrl %s', (apiBaseUrl) => {
    expect(AppConfigSchema.safeParse({ ...valid, apiBaseUrl }).success).toBe(
      false,
    );
  });

  it('provides the parsed config as APP_CONFIG', () => {
    TestBed.configureTestingModule({ providers: [provideAppConfig(valid)] });
    expect(TestBed.inject(APP_CONFIG)).toEqual(valid);
  });

  it('fails fast with the offending field on invalid input', () => {
    expect(() =>
      provideAppConfig({ ...valid, apiBaseUrl: 'not a url' }),
    ).toThrow(/apiBaseUrl/);
  });
});
