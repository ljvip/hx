import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getUserRole, isLoggedIn } from '../utils/auth';
import { JSX } from 'react/jsx-dev-runtime';

interface RoleRouteProps {
  allowedRoles: string[];
  element: JSX.Element;
}

const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles, element }) => {
  const location = useLocation();

  // 检查是否已登录
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = getUserRole();

  // 角色未匹配，跳转首页
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  // 有权限访问
  return element;
};

export default RoleRoute;
