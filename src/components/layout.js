import React, { useEffect, useMemo, useState } from 'react'
import { Link, graphql, useStaticQuery } from 'gatsby'
import Helmet from 'react-helmet'
import { ThemeProvider, createMuiTheme } from '@material-ui/core'

import EE from '../utils/EventEmitter'
import Toggle from './Toggle'
import sun from '../assets/sun.png'
import moon from '../assets/moon.png'
import { rhythm } from '../utils/typography'
import moment from 'moment'

const Layout = (props) => {
  const { title, children } = props
  const [theme, setTheme] = useState(null)
  const themeEvent = useMemo(() => new EE({
    preferredTheme: null
  }, conf => {
    try {
      conf.preferredTheme = window.localStorage.getItem('theme') || 'light'
    } catch (err) {}
  }), [])
  const themeConfig = useMemo(() => createMuiTheme({
    palette: {
      type: theme
      // todo
    }
  }), [theme])
  useEffect(() => {
    setTheme(localStorage.getItem('theme') || 'light')
    document.body.className = themeEvent.conf.preferredTheme
    themeEvent.on('setTheme', function (themeKey) {
      this.conf.preferredTheme = themeKey
    }).on('setTheme', themeKey => {
      document.body.className = themeKey
    }).on('setTheme', themeKey => {
      try {
        window.localStorage.setItem('theme', themeKey)
      } catch (err) {}
    })
    themeEvent.on('setTheme', themeKey => setTheme(themeKey))
  }, [])
  const data = useStaticQuery(graphql`
    query LayoutQuery {
      site {
        buildTime
      }
    }
  `)

  const header = (
    <h3
      style={{
        fontFamily: 'Montserrat, sans-serif',
        marginTop: 0
      }}
    >
      <Link
        style={{
          boxShadow: 'none',
          textDecoration: 'none',
          color: 'inherit'
        }}
        to={'/'}
      >
        {title}
      </Link>
    </h3>
  )
  return (
    <ThemeProvider theme={themeConfig}>
      <div
        style={{
          color: 'var(--textNormal)',
          background: 'var(--bg)',
          // transition: 'color 0.2s ease-out, background 0.2s ease-out',
          // minHeight: '100vh',
          marginLeft: 'auto',
          marginRight: 'auto',
          maxWidth: rhythm(24),
          padding: `${rhythm(1.5)} ${rhythm(3 / 4)}`
        }}
      >
        <Helmet
          meta={[
            {
              name: 'theme-color',
              content: theme === 'light' ? '#ffa8c5' : '#282c35'
            }
          ]}
        />
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2.625rem'
          }}
        >
          {header}
          {theme != null ? (
            <Toggle
              icons={{
                checked: (
                  <img
                    src={moon}
                    width='16'
                    height='16'
                    role='presentation'
                    style={{ pointerEvents: 'none' }}
                  />
                ),
                unchecked: (
                  <img
                    src={sun}
                    width='16'
                    height='16'
                    role='presentation'
                    style={{ pointerEvents: 'none' }}
                  />
                )
              }}
              checked={theme === 'dark'}
              onChange={e =>
                themeEvent.emit('setTheme',
                  e.target.checked ? 'dark' : 'light')
              }
            />
          ) : (
            <div style={{ height: '24px' }}/>
          )}
        </header>
        <main>{children}</main>
        <footer>
        © {new Date().getFullYear()}, Built {' '}
        on {moment(data.site.buildTime).local().format('YYYY D Mo, H:m')}{' '}
        with <a href='https://www.gatsbyjs.org'>Gatsby</a>
        </footer>
      </div>
    </ThemeProvider>
  )
}

export default Layout
