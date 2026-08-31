import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";

import en from "../i18n/messages/en.json";
import zh from "../i18n/messages/zh.json";

type Locale = "zh" | "en";
type MessageTree = Record<string, unknown>;

const messages: Record<Locale, MessageTree> = { zh, en };

const I18nContext = createContext<{
  locale: Locale;
  messages: MessageTree;
}>({ locale: "zh", messages: zh });

export function I18nProvider({
  locale,
  children,
}: PropsWithChildren<{ locale: Locale }>) {
  return (
    <I18nContext.Provider value={{ locale, messages: messages[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

export function useTranslations(namespace: string) {
  const { messages: currentMessages } = useContext(I18nContext);

  return useMemo(() => {
    return (key: string, values?: Record<string, string | number>) => {
      const value = readMessage(currentMessages[namespace], key);
      if (typeof value !== "string") return namespace + "." + key;
      return value.replace(/\{(\w+)\}/g, (match, name: string) => {
        const replacement = values?.[name];
        return replacement === undefined ? match : String(replacement);
      });
    };
  }, [currentMessages, namespace]);
}

function readMessage(namespace: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((value, part) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[part];
  }, namespace);
}
