import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import RouteError from './components/RouteError'
import Home from './pages/Home'
import SentenceForm from './pages/SentenceForm'
import SentenceLibrary from './pages/SentenceLibrary'
import SentenceDetail from './pages/SentenceDetail'
import WordLibrary from './pages/WordLibrary'
import WordDetail from './pages/WordDetail'
import Review from './pages/Review'
import './styles.css'

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/sentences', element: <SentenceLibrary /> },
      { path: '/sentences/new', element: <SentenceForm /> },
      { path: '/sentences/:id', element: <SentenceDetail /> },
      { path: '/sentences/:id/edit', element: <SentenceForm /> },
      { path: '/words', element: <WordLibrary /> },
      { path: '/words/:id', element: <WordDetail /> },
      { path: '/review/sentences', element: <Review type="sentences" /> },
      { path: '/review/words', element: <Review type="words" /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>,
)
