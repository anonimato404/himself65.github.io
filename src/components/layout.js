import React from 'react'
import { Link } from 'gatsby'
import Toggle from './Toggle'
import sun from '../assets/sun.png'
import moon from '../assets/moon.png'
import Helmet from 'react-helmet'

import { rhythm, scale } from '../utils/typography'

class Layout extends React.Component {
  state = {
    theme: null
  }

  componentDidMount () {
    this.setState({ theme: window.__theme })
    window.__onThemeChange = () => {
      this.setState({ theme: window.__theme })
    }
  }

  render () {
    const { location, title, children } = this.props
    const rootPath = `${__PATH_PREFIX__}/`
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
              content: this.state.theme === 'light' ? '#ffa8c5' : '#282c35'
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
          {this.state.theme !== null ? (
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
              checked={this.state.theme === 'dark'}
              onChange={e =>
                window.__setPreferredTheme(e.target.checked ? 'dark' : 'light')
              }
            />
          ) : (
            <div style={{ height: '24px' }}/>
          )}
        </header>
        <main>{children}</main>
        <footer>
          © {new Date().getFullYear()}, Built with{' '}
          <a href='https://www.gatsbyjs.org'>Gatsby</a>
        </footer>
      </div>
    )
  }
}

export default Layout
