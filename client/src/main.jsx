import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';

const domain = "dev-tttdz2uurevzcaog.us.auth0.com";  // Your Auth0 Domain
const clientId = "og3kzXtXzUuXYCsvb5cmUXYVW76UEI7X"; // Your Auth0 Client ID

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      cacheLocation="localstorage"
      useRefreshTokens={true}
      authorizationParams={{
        redirect_uri: "http://localhost:5173/callback",  // Ensure this is the same as in the Auth0 dashboard
        scope: "openid profile email offline_access"  // Include offline_access for refresh tokens
      }}
      onRedirectCallback={(appState) => {
        window.history.replaceState(
          {},
          document.title,
          appState?.returnTo || '/home'  // Use your home route here
        );
      }}
    >
      <App />
    </Auth0Provider>
  </BrowserRouter>
);