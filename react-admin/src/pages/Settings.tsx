import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
  Spin,
  Switch,
  message,
} from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { isAxiosError } from 'axios';
import { settingsApi, AppSettings, SettingValue } from '../api/settings';

const Settings: React.FC = () => {
  const [form] = Form.useForm<AppSettings>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await settingsApi.getSettings();
      setSettings(response.settings);
      setRemarks(response.remarks || {});
      form.setFieldsValue(response.settings);
    } catch (error) {
      console.error('获取配置失败:', error);
      message.error('获取系统配置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const response = await settingsApi.updateSettings(values);
      message.success(response.message || '配置更新成功');
      await fetchSettings();
    } catch (error: unknown) {
      console.error('更新配置失败:', error);
      const errorMessage = isAxiosError(error) && typeof error.response?.data?.error === 'string'
        ? error.response.data.error
        : '更新配置失败';
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      form.setFieldsValue(settings);
      message.info('已重置为当前配置');
    }
  };

  const renderInput = (value: SettingValue) => {
    if (typeof value === 'number') {
      return (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          step={Number.isInteger(value) ? 1 : 0.01}
          precision={Number.isInteger(value) ? 0 : 2}
          placeholder="请输入配置值"
        />
      );
    }

    return <Input placeholder="请输入配置值" />;
  };

  const renderConfigItem = ([key, value]: [string, SettingValue]) => {
    const label = remarks[key] || key;
    if (key === 'payout_enabled') {
      return (
        <Form.Item
          key={key}
          label={label}
          name={key}
          getValueFromEvent={(checked: boolean) => (checked ? 1 : 0)}
          getValueProps={(val) => ({ checked: Number(val) === 1 })}
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>
      );
    }

    const isNumber = typeof value === 'number';

    return (
      <Form.Item
        key={key}
        label={
          <Space>
            <span>{label}</span>
          </Space>
        }
        name={key}
        rules={[
          { required: true, message: `请输入${label}` },
          ...(isNumber ? [{ type: 'number' as const, min: 0, message: `${label}不能为负数` }] : []),
        ]}
      >
        {renderInput(value)}
      </Form.Item>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spin size="large" tip="加载配置中..." />
      </div>
    );
  }

  const settingEntries = settings ? Object.entries(settings) : [];

  return (
    <Card
      title={
        <Space>
          <span>系统配置</span>
          {settings && (
            <span style={{ fontSize: 12, color: '#888', fontWeight: 'normal' }}>
              最后更新: {new Date().toLocaleString()}
            </span>
          )}
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchSettings}>
            刷新
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            保存配置
          </Button>
        </Space>
      }
    >
      <Alert
        message="提示"
        description="修改配置后请点击「保存配置」按钮生效，配置变更会影响系统运行，请谨慎操作。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form form={form} layout="vertical">
        <Row gutter={24}>
          {settingEntries.map((entry) => (
            <Col key={entry[0]} xs={24} md={12}>
              {renderConfigItem(entry)}
            </Col>
          ))}
        </Row>

        <Card size="small" title="当前配置预览" style={{ marginTop: 8 }}>
          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
            {settingEntries.map(([key, value]) => (
              <Descriptions.Item key={key} label={remarks[key] || key}>
                {String(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={handleReset}>重置</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            保存配置
          </Button>
        </div>
      </Form>
    </Card>
  );
};

export default Settings;
