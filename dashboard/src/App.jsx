import { useState, useCallback } from 'react';
import TopBar from './components/TopBar';
import Room1View from './views/Room1View';
import Room2View from './views/Room2View';
import CombinedView from './views/CombinedView';
import './App.css';

export default function App() {
  const getInitialView = () => {
    const hash = window.location.hash.replace('#', '');
    return ['room1', 'room2', 'combined'].includes(hash) ? hash : 'room1';
  };

  const [activeView, setActiveView] = useState(getInitialView);

  const switchView = useCallback((view) => {
    setActiveView(view);
    window.location.hash = view;
  }, []);

  return (
    <>
      <TopBar activeView={activeView} onSwitch={switchView} />
      <div className="container">
        {activeView === 'room1' && <Room1View />}
        {activeView === 'room2' && <Room2View />}
        {activeView === 'combined' && <CombinedView />}
      </div>
    </>
  );
}
