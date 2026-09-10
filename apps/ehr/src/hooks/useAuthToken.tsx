import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

let _token: string | undefined = undefined;

// Sijil: in local mode the token comes from the Go gateway's demo login
// (POST /v1/auth/login, fhir-go internal/auth/exchange.go) rather than Auth0,
// because we have no Oystehr Auth0 tenant. Everything downstream is unchanged:
// useAppClients still feeds this string to the SDK as accessToken.
const IS_LOCAL = import.meta.env.VITE_APP_IS_LOCAL === 'true';
const GATEWAY_LOGIN_URL = `${import.meta.env.VITE_APP_PROJECT_API_URL}/auth/login`;

/**
 * In-flight de-duplication. The effect below re-runs on every render whose
 * useAuth0() identities change, and `_token` is only assigned once the request
 * resolves — so without memoising the promise, each render starts another login
 * while the previous is still in flight, and each resolution re-renders. That is
 * a self-sustaining request storm (observed: 60+ logins and React's
 * "Maximum update depth exceeded" before the first paint). Memoising means one
 * network call no matter how many times the effect fires; a failure clears the
 * memo so a later render can legitimately retry.
 */
let _pending: Promise<string | undefined> | undefined = undefined;

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

function localTokenOnce(): Promise<string | undefined> {
  _pending ??= fetchLocalToken()
    .then((token) => {
      _token = token;
      return token;
    })
    .catch((error) => {
      console.error('Unable to get a token from the Sijil gateway', error);
      _pending = undefined; // allow a retry rather than wedging on one failure
      return undefined;
    });
  return _pending;
}

export function useAuthToken(): string | undefined {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [token, setToken] = useState<string | undefined>(_token);

  useEffect(() => {
    let active = true;
    const apply = (newToken: string | undefined): void => {
      if (active && newToken) {
        setToken(newToken);
      }
    };

    if (_token) {
      apply(_token);
      return;
    }

    if (IS_LOCAL) {
      void localTokenOnce().then(apply);
      return () => {
        active = false;
      };
    }

    if (isAuthenticated) {
      getAccessTokenSilently()
        .then((newToken) => {
          _token = newToken;
          apply(newToken);
        })
        .catch(() => console.error('Unable to get auth0 token'));
    }

    return () => {
      active = false;
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  return token;
}
