import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

let _token: string | undefined = undefined;

// Sijil: in local mode the token comes from the Go gateway's demo login
// (POST /v1/auth/login, fhir-go internal/auth/exchange.go) rather than Auth0,
// because we have no Oystehr Auth0 tenant. Everything downstream is unchanged:
// useAppClients still feeds this string to the SDK as accessToken.
const IS_LOCAL = import.meta.env.VITE_APP_IS_LOCAL === 'true';
const GATEWAY_LOGIN_URL = `${import.meta.env.VITE_APP_PROJECT_API_URL}/auth/login`;

async function fetchLocalToken(): Promise<string> {
  const res = await fetch(GATEWAY_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@sijil.local', password: 'demo' }),
  });
  if (!res.ok) {
    throw new Error(`gateway login failed: ${res.status}`);
  }
  const body = (await res.json()) as { accessToken?: string; access_token?: string };
  const token = body.accessToken ?? body.access_token;
  if (!token) {
    throw new Error('gateway login returned no access token');
  }
  return token;
}

export function useAuthToken(): string | undefined {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [token, setToken] = useState<string | undefined>(_token);

  useEffect(() => {
    if (_token) {
      return;
    }

    if (IS_LOCAL) {
      fetchLocalToken()
        .then((newToken) => {
          _token = newToken;
          setToken(newToken);
        })
        .catch((error) => console.error('Unable to get a token from the Sijil gateway', error));
      return;
    }

    if (isAuthenticated) {
      getAccessTokenSilently()
        .then((newToken) => {
          _token = newToken;
          setToken(newToken);
        })
        .catch(() => console.error('Unable to get auth0 token'));
    }
  }, [isAuthenticated, getAccessTokenSilently, setToken]);

  return token;
}
