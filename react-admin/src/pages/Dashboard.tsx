// src/pages/Dashboard.tsx
import { Layout, Menu, Button, Drawer } from 'antd';
import { Outlet, useNavigate } from 'react-router-dom';
import { getUserRole } from '../utils/auth';
import { MenuOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useResponsive } from '../hooks/useResponsive';

const { Header, Content, Sider } = Layout;

const Dashboard = () => {
  const navigate = useNavigate();
  const role = getUserRole();
  const { isMobile } = useResponsive();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const allMenuItems = [
    { key: 'create-admin', label: '登入管理', roles: ['super_admin'] },
    { key: 'hx-users', label: '用户数据', roles: ['super_admin'] },
    { key: 'bet-results', label: '投注记录', roles: ['super_admin'] },
    { key: 'commission-results', label: '佣金记录', roles: ['super_admin'] },
    { key: 'game-commission', label: '游戏佣金', roles: ['super_admin'] },
    { key: 'dl-address', label: '游戏地址', roles: ['super_admin'] },
    // 🆕 系统配置
    { key: 'settings', label: '系统配置', roles: ['super_admin'] },
    // 股东管理
    { key: 'shareholder-list', label: '股东列表', roles: ['super_admin'] },
    { key: 'shareholder-transactions', label: '股东积分查询', roles: ['super_admin'] },
    // { key: 'shareholder-assign', label: '股东分配', roles: ['super_admin'] },
    // 代理相关
    { key: 'dl-Referral', label: '代理伞下数据', roles: ['admin', 'super_admin'] },
    { key: 'dl-commission', label: '代理伞下佣金', roles: ['admin', 'super_admin'] },
  ];

  const filteredMenu = allMenuItems.filter(item => item.roles.includes(role || ''));

  const menuItems = filteredMenu.map(item => ({
    key: item.key,
    label: item.label,
    onClick: () => {
      navigate(`${item.key}`);
      if (isMobile) setMenuOpen(false);
    }
  }));

  const MenuComponent = () => (
    <Menu
      mode={isMobile ? 'vertical' : 'inline'}
      items={menuItems}
      style={{ height: '100%', borderRight: 0 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        color: 'white', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: 'white' }} />}
              onClick={() => setMenuOpen(true)}
            />
          )}
          <span style={{ fontSize: isMobile ? 16 : 20, fontWeight: 'bold' }}>
            管理后台
          </span>
        </div>
        <Button type="primary" danger onClick={handleLogout} size={isMobile ? 'small' : 'middle'}>
          退出
        </Button>
      </Header>

      <Layout>
        {isMobile ? (
          <Drawer
            placement="left"
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            width={280}
            styles={{ body: { padding: 0 } }}   // ✅ 新 API
          >
            <MenuComponent />
          </Drawer>
        ) : (
          <Sider width={200} style={{ background: '#fff' }}>
            <MenuComponent />
          </Sider>
        )}

        <Layout style={{ 
          padding: isMobile ? '12px' : '20px',
          background: '#f5f7fa',
        }}>
          <Content style={{ 
            background: '#fff', 
            padding: isMobile ? 12 : 24,
            borderRadius: 8,
            minHeight: 280,
          }}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default Dashboard;