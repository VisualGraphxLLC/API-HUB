export default function ConfigureStorefrontPage() {
  return (
    <div className="screen active">
      <div className="page-header">
        <div>
          <div className="page-title">Product Setup</div>
          <div className="page-subtitle">Configure OPS storefront settings</div>
        </div>
      </div>
      <div className="panel" style={{ padding: "40px", textAlign: "center" }}>
        <h2 style={{ marginBottom: "16px", color: "var(--ink)" }}>Storefront Configuration</h2>
        <p style={{ color: "var(--ink-muted)", maxWidth: "500px", margin: "0 auto" }}>
          This feature (V1g Task 23) is currently under development by Tanishq and Vidhi.
          It will allow you to configure OPS categories, master options, and pricing previews before publishing.
        </p>
      </div>
    </div>
  );
}
