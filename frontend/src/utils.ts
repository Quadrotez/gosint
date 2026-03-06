import type { Entity, EntityTypeSchema } from './types';

export const ENTITY_COLORS: Record<string, string> = {
  person: '#00d4ff',
  email: '#00ff88',
  phone: '#ffd700',
  username: '#8b5cf6',
  domain: '#ff6b35',
  ip: '#ff4444',
  organization: '#06b6d4',
  address: '#a78bfa',
  website: '#34d399',
  crypto_wallet: '#f59e0b',
};

export const ENTITY_ICONS: Record<string, string> = {
  person: '👤',
  email: '✉️',
  phone: '📞',
  username: '@',
  domain: '🌐',
  ip: '🔌',
  organization: '🏢',
  address: '📍',
  website: '🔗',
  crypto_wallet: '₿',
};

export const BUILTIN_TYPE_LABELS: Record<string, { en: string; ru: string }> = {
  person:        { en: 'Person',        ru: 'Персона' },
  email:         { en: 'Email',         ru: 'Электронная почта' },
  phone:         { en: 'Phone',         ru: 'Телефон' },
  username:      { en: 'Username',      ru: 'Имя пользователя' },
  domain:        { en: 'Domain',        ru: 'Домен' },
  ip:            { en: 'IP Address',    ru: 'IP-адрес' },
  organization:  { en: 'Organization',  ru: 'Организация' },
  address:       { en: 'Address',       ru: 'Адрес' },
  website:       { en: 'Website',       ru: 'Веб-сайт' },
  crypto_wallet: { en: 'Crypto Wallet', ru: 'Крипто-кошелёк' },
};

export const BUILTIN_ENTITY_TYPES = [
  'person', 'email', 'phone', 'username', 'domain',
  'ip', 'organization', 'address', 'website', 'crypto_wallet',
];

// kept for backwards compat
export const ENTITY_TYPES = BUILTIN_ENTITY_TYPES;

export const RELATIONSHIP_TYPES = [
  'owns', 'uses', 'registered_to', 'linked_to', 'friend_of',
  'member_of', 'controls', 'associated_with', 'works_at', 'located_at',
];

// Person-specific relationship types with friendly names
export const PERSON_RELATIONSHIP_TYPES: { value: string; label_en: string; label_ru: string; emoji: string }[] = [
  { value: 'colleague',    label_en: 'Colleague',      label_ru: 'Коллега',          emoji: '💼' },
  { value: 'spouse',       label_en: 'Spouse',         label_ru: 'Супруг/Супруга',   emoji: '💍' },
  { value: 'partner',      label_en: 'Partner',        label_ru: 'Партнёр',          emoji: '🤝' },
  { value: 'relative',     label_en: 'Relative',       label_ru: 'Родственник',      emoji: '👨‍👩‍👧' },
  { value: 'friend',       label_en: 'Friend',         label_ru: 'Друг',             emoji: '👫' },
  { value: 'acquaintance', label_en: 'Acquaintance',   label_ru: 'Знакомый',         emoji: '🙋' },
  { value: 'boss',         label_en: 'Boss / Employer',label_ru: 'Начальник',        emoji: '👔' },
  { value: 'subordinate',  label_en: 'Subordinate',    label_ru: 'Подчинённый',      emoji: '📋' },
  { value: 'business_partner', label_en: 'Business Partner', label_ru: 'Бизнес-партнёр', emoji: '🏢' },
  { value: 'linked_to',    label_en: 'Linked to',      label_ru: 'Связан с',         emoji: '🔗' },
  { value: 'owns',         label_en: 'Owns',           label_ru: 'Владеет',          emoji: '📦' },
  { value: 'uses',         label_en: 'Uses',           label_ru: 'Использует',       emoji: '⚙️' },
  { value: 'member_of',    label_en: 'Member of',      label_ru: 'Участник',         emoji: '🏛️' },
  { value: 'associated_with', label_en: 'Associated with', label_ru: 'Ассоциирован с', emoji: '➰' },
];

// Generic relationship types for non-person entities
export const GENERIC_RELATIONSHIP_TYPES: { value: string; label_en: string; label_ru: string; emoji: string }[] = [
  { value: 'linked_to',        label_en: 'Linked to',       label_ru: 'Связан с',         emoji: '🔗' },
  { value: 'owns',             label_en: 'Owns',            label_ru: 'Владеет',          emoji: '📦' },
  { value: 'uses',             label_en: 'Uses',            label_ru: 'Использует',       emoji: '⚙️' },
  { value: 'registered_to',    label_en: 'Registered to',   label_ru: 'Зарегистрирован',  emoji: '📝' },
  { value: 'member_of',        label_en: 'Member of',       label_ru: 'Участник',         emoji: '🏛️' },
  { value: 'controls',         label_en: 'Controls',        label_ru: 'Управляет',        emoji: '🎮' },
  { value: 'associated_with',  label_en: 'Associated with', label_ru: 'Ассоциирован с',   emoji: '➰' },
  { value: 'works_at',         label_en: 'Works at',        label_ru: 'Работает в',       emoji: '💼' },
  { value: 'located_at',       label_en: 'Located at',      label_ru: 'Находится по',     emoji: '📍' },
];

// Built-in field presets for entity types
export const BUILTIN_FIELD_PRESETS: Record<string, { key: string; label_en: string; label_ru: string; type: 'text' | 'date' | 'url' | 'number' }[]> = {
  address: [
    { key: 'country',    label_en: 'Country',          label_ru: 'Страна',          type: 'text' },
    { key: 'region',     label_en: 'Region / Oblast',  label_ru: 'Регион / Область',type: 'text' },
    { key: 'city',       label_en: 'City',             label_ru: 'Город',           type: 'text' },
    { key: 'district',   label_en: 'District',         label_ru: 'Район',           type: 'text' },
    { key: 'street',     label_en: 'Street',           label_ru: 'Улица',           type: 'text' },
    { key: 'building',   label_en: 'Building / House', label_ru: 'Дом / Строение',  type: 'text' },
    { key: 'apartment',  label_en: 'Apartment',        label_ru: 'Квартира',        type: 'text' },
    { key: 'postal_code',label_en: 'Postal Code',      label_ru: 'Почтовый индекс', type: 'text' },
    { key: 'cadastral',  label_en: 'Cadastral Number', label_ru: 'Кадастровый №',   type: 'text' },
    { key: 'coordinates',label_en: 'Coordinates',      label_ru: 'Координаты',      type: 'text' },
  ],
  phone: [
    { key: 'country_code', label_en: 'Country Code', label_ru: 'Код страны',   type: 'text' },
    { key: 'carrier',      label_en: 'Carrier',      label_ru: 'Оператор',     type: 'text' },
    { key: 'type',         label_en: 'Type',         label_ru: 'Тип',          type: 'text' },
    { key: 'owner_name',   label_en: 'Owner Name',   label_ru: 'Имя владельца',type: 'text' },
  ],
  email: [
    { key: 'provider',     label_en: 'Provider',     label_ru: 'Провайдер',    type: 'text' },
    { key: 'created_date', label_en: 'Created date', label_ru: 'Дата создания',type: 'date' },
    { key: 'recovery',     label_en: 'Recovery',     label_ru: 'Восстановление',type: 'text' },
  ],
  organization: [
    { key: 'type',         label_en: 'Type',         label_ru: 'Тип',          type: 'text' },
    { key: 'inn',          label_en: 'Tax ID / INN', label_ru: 'ИНН',          type: 'text' },
    { key: 'ogrn',         label_en: 'OGRN / Reg №', label_ru: 'ОГРН',         type: 'text' },
    { key: 'website',      label_en: 'Website',      label_ru: 'Сайт',         type: 'url' },
    { key: 'founded',      label_en: 'Founded',      label_ru: 'Основана',     type: 'date' },
    { key: 'employees',    label_en: 'Employees',    label_ru: 'Сотрудники',   type: 'number' },
  ],
  ip: [
    { key: 'asn',          label_en: 'ASN',          label_ru: 'ASN',          type: 'text' },
    { key: 'isp',          label_en: 'ISP',          label_ru: 'Провайдер',    type: 'text' },
    { key: 'country',      label_en: 'Country',      label_ru: 'Страна',       type: 'text' },
    { key: 'city',         label_en: 'City',         label_ru: 'Город',        type: 'text' },
    { key: 'abuse',        label_en: 'Abuse Contact',label_ru: 'Abuse-контакт',type: 'text' },
  ],
  domain: [
    { key: 'registrar',    label_en: 'Registrar',    label_ru: 'Регистратор',  type: 'text' },
    { key: 'registered',   label_en: 'Registered',   label_ru: 'Зарегистрирован',type: 'date' },
    { key: 'expires',      label_en: 'Expires',      label_ru: 'Истекает',     type: 'date' },
    { key: 'nameservers',  label_en: 'Nameservers',  label_ru: 'NS-серверы',   type: 'text' },
  ],
  crypto_wallet: [
    { key: 'blockchain',   label_en: 'Blockchain',   label_ru: 'Блокчейн',     type: 'text' },
    { key: 'balance',      label_en: 'Balance',      label_ru: 'Баланс',       type: 'text' },
    { key: 'exchange',     label_en: 'Exchange',     label_ru: 'Биржа',        type: 'text' },
  ],
};

export function getTypeLabel(
  type: string,
  lang: 'en' | 'ru',
  customSchemas?: EntityTypeSchema[]
): string {
  const builtin = BUILTIN_TYPE_LABELS[type];
  if (builtin) return lang === 'ru' ? builtin.ru : builtin.en;
  if (customSchemas) {
    const s = customSchemas.find(s => s.name === type);
    if (s) return lang === 'ru' && s.label_ru ? s.label_ru : s.label_en;
  }
  return type;
}

export function getEntityColor(
  type: string,
  customSchemas?: EntityTypeSchema[]
): string {
  if (ENTITY_COLORS[type]) return ENTITY_COLORS[type];
  if (customSchemas) {
    const s = customSchemas.find(s => s.name === type);
    if (s?.color) return s.color;
  }
  return '#7a8ba8';
}

export function getEntityIcon(
  type: string,
  customSchemas?: EntityTypeSchema[]
): string {
  if (ENTITY_ICONS[type]) return ENTITY_ICONS[type];
  if (customSchemas) {
    const s = customSchemas.find(s => s.name === type);
    if (s?.icon) return s.icon;
  }
  return '◆';
}

export function getPersonDisplayName(entity: Entity): string {
  const m = entity.metadata as Record<string, string> | null;
  if (!m) return entity.value;
  const parts = [m.last_name, m.first_name, m.middle_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : entity.value;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/__+/g, '_');
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export function randomColor(): string {
  const p = [
    '#f43f5e', '#ec4899', '#a855f7', '#6366f1', '#3b82f6',
    '#06b6d4', '#10b981', '#84cc16', '#eab308', '#f97316',
  ];
  return p[Math.floor(Math.random() * p.length)];
}
