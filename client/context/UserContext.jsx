import { createContext, useState, useContext } from 'react';
import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';


const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const { user: auth0User, isAuthenticated } = useAuth0();
    // initialize state from localStorage for refreshing page
    const [dbUser, setDbUser] = useState(() => {
        const savedUser = localStorage.getItem('app_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    // whenever dbUser changes, sync it to localStorage
    useEffect(() => {
        if (dbUser) {
            localStorage.setItem('app_user', JSON.stringify(dbUser));
        } else {
            localStorage.removeItem('app_user');
        }
    }, [dbUser]);

     // Fetch dbUser from backend if we have Auth0 user but no dbUser yet
    useEffect(() => {
    const fetchDbUser = async () => {
      if (!auth0User?.sub) {
        setDbUser(null);
        return;
      }

      try {
        const res = await fetch(`http://localhost:8080/api/user/${auth0User.sub}`);
        if (!res.ok) throw new Error("Failed to fetch user from backend");
        const data = await res.json();
        setDbUser(data);
      } catch (err) {
        console.error("Error fetching dbUser:", err);
      }
    };

    fetchDbUser();
  }, [auth0User, dbUser]);
    
    return (
        <UserContext.Provider value={{ dbUser, setDbUser }}>
            {children}
        </UserContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => useContext(UserContext);