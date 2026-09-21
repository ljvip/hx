// src/router/index.tsx
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import RoleRoute from './RoleRoute';

const Login = lazy(() => import('../pages/Login'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const BetResults = lazy(() => import('../pages/BetResults'));
const UserList = lazy(() => import('../pages/UserList'));
const Dladdress = lazy(() => import('../pages/Dladdress'));
const CommissionResults = lazy(() => import('../pages/CommissionResults'));
const GameCommissionRate = lazy(() => import('../pages/GameCommissionRate'));
const DlReferral = lazy(() => import('../pages/DlReferral'));
const CreateAdmin = lazy(() => import('../pages/CreateAdmin'));
const DlCommission = lazy(() => import('../pages/DlCommission'));
const ShareholderList = lazy(() => import('../pages/ShareholderList'));
const ShareholderTransactions = lazy(() => import('../pages/ShareholderTransactions'));
const ShareholderAssign = lazy(() => import('../pages/ShareholderAssign'));
const Settings = lazy(() => import('../pages/Settings'));

const AppRouter = () => (
  <Suspense fallback={<div>加载中...</div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>}>
        <Route path="bet-results" element={<RoleRoute allowedRoles={['super_admin']} element={<BetResults />} />} />
        <Route path="hx-users" element={<RoleRoute allowedRoles={['super_admin']} element={<UserList />} />} />
        <Route path="dl-address" element={<RoleRoute allowedRoles={['super_admin']} element={<Dladdress />} />} />
        <Route path="commission-results" element={<RoleRoute allowedRoles={['super_admin']} element={<CommissionResults />} />} />
        <Route path="game-commission" element={<RoleRoute allowedRoles={['super_admin']} element={<GameCommissionRate />} />} />
        <Route path="create-admin" element={<RoleRoute allowedRoles={['super_admin']} element={<CreateAdmin />} />} />
        <Route path="settings" element={<RoleRoute allowedRoles={['super_admin']} element={<Settings />} />} />
        <Route path="shareholder-list" element={<RoleRoute allowedRoles={['super_admin']} element={<ShareholderList />} />} />
        <Route path="shareholder-transactions" element={<RoleRoute allowedRoles={['super_admin']} element={<ShareholderTransactions />} />} />
        <Route path="shareholder-assign" element={<RoleRoute allowedRoles={['super_admin']} element={<ShareholderAssign />} />} />
        <Route path="dl-Referral" element={<RoleRoute allowedRoles={['admin', 'super_admin']} element={<DlReferral />} />} />
        <Route path="dl-commission" element={<RoleRoute allowedRoles={['admin', 'super_admin']} element={<DlCommission />} />} />
      </Route>
    </Routes>
  </Suspense>
);

export default AppRouter;