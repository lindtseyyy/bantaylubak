import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { useSettings } from './lib/settings'
import { DetailsScreen } from './screens/DetailsScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ScanScreen } from './screens/ScanScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'

function AppRoutes() {
  const { onboarded } = useSettings()

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/welcome" element={<WelcomeScreen />} />
        <Route
          path="/"
          element={
            onboarded ? <HomeScreen /> : <Navigate to="/welcome" replace />
          }
        />
        <Route path="/scan" element={<ScanScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/history/:id" element={<DetailsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
