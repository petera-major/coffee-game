import Game from "./Game.jsx";

export default function App() {
  return (
    <div style={{height:"100vh", display:"grid", placeItems:"center", background: "#111"}}>
    <Game width={1050} height={800} />
    </div>
    
  );
}