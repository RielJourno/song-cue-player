import { Routes, Route } from 'react-router-dom';
import LibraryScreen from './screens/LibraryScreen';
import SongScreen from './screens/SongScreen';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LibraryScreen />} />
      <Route path="/song/:id" element={<SongScreen />} />
    </Routes>
  );
}
