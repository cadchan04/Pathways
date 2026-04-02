import { createContext, useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { syncUser } from '../src/services/userServices';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const { user: auth0User } = useAuth0();
    const [dbUser, setDbUser] = useState(() => {
        const savedUser = localStorage.getItem('app_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    useEffect(() => {
        if (dbUser) {
            localStorage.setItem('app_user', JSON.stringify(dbUser));
        } else {
            localStorage.removeItem('app_user');
        }
    }, [dbUser]);

    useEffect(() => {
        const syncAndFetchUser = async () => {
            if (!auth0User?.sub) {
                setDbUser(null);
                return;
            }
            const data = await syncUser({
                sub: auth0User.sub,
                email: auth0User.email,
                name: auth0User.name,
                picture: auth0User.picture
            });
            console.log("syncUser returned:", data)
            setDbUser(data);
        };
        syncAndFetchUser();
    }, [auth0User]);

    return (
        <UserContext.Provider value={{ dbUser, setDbUser }}>
            {children}
        </UserContext.Provider>
    );
};