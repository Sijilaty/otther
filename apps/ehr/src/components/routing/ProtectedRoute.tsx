import { useAuth0 } from '@auth0/auth0-react';
import { FC, ReactElement } from 'react';
import { LoadingScreen } from '../LoadingScreen';

interface ProtectedRouteProps {
  showWhenAuthenticated: ReactElement;
}

// Sijil: local mode has no Auth0 tenant. Upstream unconditionally redirects to
// Oystehr's Auth0 (auth.zapehr.com), which we do not and will not have — so in
// local mode we render straight through and let useAuthToken source a token
// from the Go gateway instead. Production auth is Medplum's own OIDC via
// authorization-code + PKCE (fhir-go gates/AUTH-07-medplum-oidc-feasibility.md
// = PASS); this bypass is deliberately confined to VITE_APP_IS_LOCAL.
const IS_LOCAL = import.meta.env.VITE_APP_IS_LOCAL === 'true';

export const ProtectedRoute: FC<ProtectedRouteProps> = (props: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (IS_LOCAL) {
    return props.showWhenAuthenticated;
  }

  if (!isAuthenticated && isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated && !isLoading) {
    loginWithRedirect().catch((error) => {
      throw new Error(`Error calling loginWithRedirect Auth0 ${error}`);
    });
  }

  return props.showWhenAuthenticated;
};
