import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEntitySchemas } from '../api';
import type { EntityTypeSchema } from '../types';
import { useLang } from '../i18n/LangProvider';
import { BUILTIN_ENTITY_TYPES, getEntityColor, getEntityIcon, getTypeLabel } from '../utils';

interface EntitySchemasCtx {
  schemas: EntityTypeSchema[];
  allTypeNames: string[];
  getColor: (type: string) => string;
  getIcon: (type: string) => string;
  getLabel: (type: string) => string;
  isLoading: boolean;
}

const Ctx = createContext<EntitySchemasCtx>({
  schemas: [],
  allTypeNames: BUILTIN_ENTITY_TYPES,
  getColor: getEntityColor,
  getIcon: getEntityIcon,
  getLabel: (t) => t,
  isLoading: false,
});

export function EntitySchemasProvider({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const { data: schemas = [], isLoading } = useQuery({
    queryKey: ['entity-schemas'],
    queryFn: getEntitySchemas,
    staleTime: 60_000,
  });

  const allTypeNames = [
    ...BUILTIN_ENTITY_TYPES,
    ...schemas.filter(s => !s.is_builtin).map(s => s.name),
  ];

  return (
    <Ctx.Provider value={{
      schemas,
      allTypeNames,
      getColor: (type) => getEntityColor(type, schemas),
      getIcon: (type) => getEntityIcon(type, schemas),
      getLabel: (type) => getTypeLabel(type, lang, schemas),
      isLoading,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEntitySchemas() {
  return useContext(Ctx);
}
