import { createContext, useState, useContext } from 'react';
import { useEffect } from 'react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
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
    
    return (
        <UserContext.Provider value={{ dbUser, setDbUser }}>
            {children}
        </UserContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => useContext(UserContext);