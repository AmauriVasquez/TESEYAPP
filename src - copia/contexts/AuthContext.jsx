import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('teseyUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('teseyUser');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (email, password) => {
    const mockUsers = {
      'admin@tesey.com': { 
        id: 1, 
        email: 'admin@tesey.com', 
        nombre: 'Administrador', 
        rol: 'Administrador' 
      },
      'ventas@tesey.com': { 
        id: 2, 
        email: 'ventas@tesey.com', 
        nombre: 'Vendedor', 
        rol: 'Ventas' 
      },
      'proyectos@tesey.com': { 
        id: 3, 
        email: 'proyectos@tesey.com', 
        nombre: 'Gestor Proyectos', 
        rol: 'Proyectos' 
      },
      'compras@tesey.com': { 
        id: 4, 
        email: 'compras@tesey.com', 
        nombre: 'Comprador', 
        rol: 'Compras' 
      },
      'almacen@tesey.com': { 
        id: 5, 
        email: 'almacen@tesey.com', 
        nombre: 'Almacenista', 
        rol: 'Almacén' 
      },
      'consulta@tesey.com': {
        id: 6,
        email: 'consulta@tesey.com',
        nombre: 'Usuario de Consulta',
        rol: 'Consulta'
      }
    };

    const foundUser = mockUsers[email];
    if (foundUser && password === 'tesey2025') {
      const userToStore = { id: foundUser.id, nombre: foundUser.nombre, email: foundUser.email, rol: foundUser.rol };
      setUser(userToStore);
      localStorage.setItem('teseyUser', JSON.stringify(userToStore));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('teseyUser');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};