import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import { UserProvider } from "../context/UserContext";
import React from 'react';

import './index.css';
import App from './App';
import './App.css';

const domain = "dev-tttdz2uurevzcaog.us.auth0.com"; 
const clientId = "og3kzXtXzUuXYCsvb5cmUXYVW76UEI7X";

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered: ', reg.scope))
      .catch(err => console.error('Sw registration failed: ', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      cacheLocation="localstorage"
      useRefreshTokens={true}
      authorizationParams={{
        redirect_uri: "http://localhost:5173/callback",
        scope: "openid profile email offline_access" 
      }}
      onRedirectCallback={(appState) => {
        window.history.replaceState(
          {},
          document.title,
          appState?.returnTo || '/my-trips'
        );
      }}
    >
      <UserProvider>
      <App />
      </UserProvider>
    </Auth0Provider>
  </BrowserRouter>
);