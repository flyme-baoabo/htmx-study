declare type StringMap<T = any> = Record<string, T>;

interface Window {
    I18n: StringMap;
}

declare let I18n: StringMap;