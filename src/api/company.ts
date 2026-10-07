import { useEffect, useState } from 'react';

import { request } from './client';

export type MyCompanyProducts = {
  company_id: string;
  company_name?: string | null;
  products: { id: string; name: string; description: string | null }[];
  product_ids: string[];
  has_jornadas: boolean;
  jornadas_implicit: boolean;
};

export async function getMyCompanyProducts(token: string) {
  return request<MyCompanyProducts>('/companies/me/products', { token });
}

/**
 * Le se a empresa do usuario tem o produto Jornadas. `hasJornadas` fica `null` enquanto carrega
 * e em caso de falha (nesse caso a tela segue funcionando como antes, sem bloquear o usuario).
 */
export function useJornadasProduct(token: string | null) {
  const [hasJornadas, setHasJornadas] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    getMyCompanyProducts(token)
      .then((data) => active && setHasJornadas(data.has_jornadas))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token]);

  return hasJornadas;
}
