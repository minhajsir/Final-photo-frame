import React, { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function App() {
  const [appUrl, setAppUrl] = useState(window.location.href);
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState("phone");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [compositeUrl, setCompositeUrl] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [posX, setPosX] = useState(30);
  const [posY, setPosY] = useState(30);
  const [opacity, setOpacity] = useState(1.0);
  const [side, setSide] = useState("right");

  useEffect(() => () => { if (stream) stream.getTracks().forEach(t=>t.stop()); }, [stream]);

  const sendOtp = async () => {
    setMessage("Sending OTP...");
    try {
      const res = await fetch(`${API_BASE}/send-otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      const j = await res.json();
      if (res.ok && j.success) { setMessage("OTP sent. Enter the code."); setStep("otp"); }
      else setMessage("Failed to send OTP: " + (j.error || JSON.stringify(j)));
    } catch (err) { setMessage("Error sending OTP: " + err.message); }
  };

  const verifyOtp = async () => {
    setMessage("Verifying OTP...");
    try {
      const res = await fetch(`${API_BASE}/verify-otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code: otp }) });
      const j = await res.json();
      if (res.ok && j.success) { setMessage("OTP verified. Start camera."); setStep("camera"); startCamera(); }
      else setMessage("Verification failed: " + (j.error || JSON.stringify(j)));
    } catch (err) { setMessage("Error verifying OTP: " + err.message); }
  };

  const startCamera = async () => {
    setMessage("");
    try {
      if (stream) stream.getTracks().forEach(t=>t.stop());
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false });
      setStream(s); if (videoRef.current) videoRef.current.srcObject = s;
    } catch (err) { setMessage("Camera error: " + err.message); }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    const w = v.videoWidth || 720, h = v.videoHeight || 1280;
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(v, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", 0.95);
    setPhotoDataUrl(dataUrl); setStep("overlay");
  };

  const requestServerComposite = async () => {
    if (!photoDataUrl) return;
    setMessage("Creating composite on server...");
    try {
      const res = await fetch(`${API_BASE}/composite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo: photoDataUrl, side, scale, posX, posY, opacity }) });
      const j = await res.json();
      if (res.ok && j.url) { setCompositeUrl(j.url); setMessage("Composite ready."); setStep("done"); }
      else setMessage("Composite failed: " + (j.error || JSON.stringify(j)));
    } catch (err) { setMessage("Composite error: " + err.message); }
  };

  return (<div className="container">
    <h1>QR → Twilio OTP → Full-length Photo → Composite</h1>
    <section className="card">
      <h2>Share with QR</h2>
      <input value={appUrl} onChange={e=>setAppUrl(e.target.value)} className="full" />
      <div style={{marginTop:8}}><QRCodeCanvas value={appUrl} size={140}/></div>
    </section>
    <section className="card">
      <h2>Phone verification</h2>
      {step==="phone" && (<><input placeholder="+919876543210" value={phone} onChange={e=>setPhone(e.target.value)} className="full" /><button className="btn" onClick={sendOtp}>Send OTP (Twilio)</button></>)}
      {step==="otp" && (<><input placeholder="Enter OTP" value={otp} onChange={e=>setOtp(e.target.value)} /><button className="btn" onClick={verifyOtp}>Verify OTP</button></>)}
      <p className="muted">{message}</p>
    </section>
    {step==="camera" && (<section className="card"><h2>Camera</h2><div className="videoWrap"><video ref={videoRef} autoPlay playsInline muted className="video"/></div><div className="controls"><button className="btn" onClick={takePhoto}>Capture Photo</button><button className="btn alt" onClick={startCamera}>Restart Camera</button></div></section>)}
    {step==="overlay" && (<section className="card"><h2>Overlay Controls (server compositing)</h2><div className="range-wrap">
      <label>Side:<select value={side} onChange={e=>setSide(e.target.value)}><option value="right">Right</option><option value="left">Left</option></select></label>
      <label>Scale:<input type="range" min="0.5" max="2" step="0.1" value={scale} onChange={e=>setScale(parseFloat(e.target.value))}/> {scale.toFixed(1)}×</label>
      <label>X:<input type="number" value={posX} onChange={e=>setPosX(parseInt(e.target.value||"0"))}/></label>
      <label>Y:<input type="number" value={posY} onChange={e=>setPosY(parseInt(e.target.value||"0"))}/></label>
      <label>Opacity:<input type="range" min="0.2" max="1" step="0.05" value={opacity} onChange={e=>setOpacity(parseFloat(e.target.value))}/> {Math.round(opacity*100)}%</label>
    </div>{photoDataUrl && <div style={{marginTop:8}}><img src={photoDataUrl} alt="user" style={{maxWidth:240}}/></div>}<div style={{marginTop:8}}><button className="btn" onClick={requestServerComposite}>Create Composite (Server)</button></div></section>)}
    {step==="done" && (<section className="card"><h2>Final Composite</h2>{compositeUrl && (<><a className="btn" href={compositeUrl} download>Download Composite</a><div style={{marginTop:8}}><img src={compositeUrl} alt="final" className="final"/></div></>)}</section>)}
    <canvas ref={canvasRef} style={{display:"none"}}/>
    <footer className="muted small" style={{marginTop:14}}>API: <code>{API_BASE}</code> — set <code>VITE_API_URL</code> for production.</footer>
  </div>);
}
