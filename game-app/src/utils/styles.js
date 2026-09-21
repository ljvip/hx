export const globalStyles = {
  container: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "16px",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    marginBottom: "16px",
  },
  title: {
    fontSize: "20px",
    fontWeight: "bold",
    marginBottom: "16px",
    textAlign: "center",
  },
  button: {
    primary: {
      backgroundColor: "#1890ff",
      borderColor: "#1890ff",
      color: "#fff",
    },
    success: {
      backgroundColor: "#52c41a",
      borderColor: "#52c41a",
      color: "#fff",
    },
    danger: {
      backgroundColor: "#ff4d4f",
      borderColor: "#ff4d4f",
      color: "#fff",
    },
  },
  text: {
    primary: { color: "#333" },
    secondary: { color: "#666" },
    success: { color: "#52c41a" },
    error: { color: "#ff4d4f" },
    warning: { color: "#faad14" },
  },
  flex: {
    row: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
    },
    column: {
      display: "flex",
      flexDirection: "column",
    },
    center: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    between: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
  },
};