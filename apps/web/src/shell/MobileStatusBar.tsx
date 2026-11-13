export function MobileStatusBar() {
  return (
    <>
  <div className="m-status-bar">
    <div className="m-status-time">13:06</div>
    <div className="m-island-pill">
      <div className="m-island-dot"></div>
      <div className="m-island-cam"></div>
    </div>
    <div className="m-status-icons">
      <span>5G</span>
      <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 18.5 12 21l7.65-2.5-.62-.89C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z" /></svg>
      <div className="m-battery-box">
        <span style={{ fontSize: 11 }}>63%</span>
        <div className="m-battery-pill"><div className="m-battery-fill"></div></div>
      </div>
    </div>
  </div>
    </>
  );
}
