import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
// import Javas from './javas'
import Javas from './MainMap'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Javas/>
    </>
  )
}

export default App
