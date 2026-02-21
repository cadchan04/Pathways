import { createContext, useState, useContext } from 'react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [dbUser, setDbUser] = useState(null);
    
    return (
        <UserContext.Provider value={{ dbUser, setDbUser }}>
            {children}
        </UserContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => useContext(UserContext);