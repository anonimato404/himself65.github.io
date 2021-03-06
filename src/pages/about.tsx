import '../style/friend.css'

import { Tooltip, Typography } from '@material-ui/core'
import Divider from '@material-ui/core/Divider'
import { makeStyles } from '@material-ui/core/styles'
import Disqus from 'disqus-react'
import { graphql } from 'gatsby'
import Image, { FluidObject } from 'gatsby-image'
import React from 'react'

import type { AboutPageQuery } from '~types'

import Layout from '../components/layout'
import ProfileCard from '../components/ProfileCard'
import SEO from '../components/seo'

const useStyles = makeStyles({
  friends: {
    display: 'flex',
    marginTop: '1rem',
    flexDirection: 'row'
  },
  friend: {
    margin: '0 0.5rem',
    '&:first-child': {
      marginLeft: '0'
    }
  },
  divider: {
    marginBottom: '1rem'
  },
  introduction: {
    '& img': {
      margin: 'auto'
    }
  },
  comment: {
    marginTop: '1.5rem'
  }
})

const AboutPage: React.FC<{ data: AboutPageQuery; url: string }> = (props) => {
  const { data } = props
  const classes = useStyles()
  const siteTitle = data.site?.siteMetadata?.title
  const discusConfig = {
    url: props.url,
    identifier: 'global-comment',
    title: '评论区'
  }

  const avatars = data.avatars.edges.filter(
    avatar => /^friend/.test(avatar.node.relativePath))
    .map(avatar => avatar.node)

  return (
    <Layout title={siteTitle}>
      <SEO title='About'/>
      <Typography
        style={{ marginTop: '1rem' }}
        variant='h5' align='center'
      >
        My Friends
      </Typography>
      <ul className={classes.friends}>
        {data.site?.siteMetadata?.friendship?.map(friend => {
          const image = avatars.find(
            v => new RegExp(friend?.image ?? '').test(v.relativePath))
          return (
            <Tooltip key={friend?.name ?? ''} title={friend?.name ?? ''}>
              <a
                href={friend?.url ?? ''}
                target='_blank'
                rel='noopener noreferrer'
                style={{
                  width: 50,
                  color: 'transparent'
                }}
              >
                <Image
                  className={classes.friend}
                  fluid={image?.childImageSharp?.fluid as FluidObject}
                  style={{
                    flex: 1,
                    maxWidth: 50,
                    borderRadius: '100%',
                    cursor: 'pointer'
                  }}
                  imgStyle={{
                    borderRadius: '50%'
                  }}
                />
              </a>
            </Tooltip>
          )
        })}
      </ul>
      <Divider className={classes.divider}/>
      <ProfileCard/>
      <div className={classes.comment}>
        <Disqus.DiscussionEmbed
          shortname={process.env.GATSBY_DISQUS_NAME as string}
          config={discusConfig}/>
      </div>
    </Layout>
  )
}

export default AboutPage

export const pageQuery = graphql`
  query AboutPage {
    site {
      siteMetadata {
        title
        friendship {
          name
          url
          image
        }
      }
    }
    avatars: allFile(filter: {relativeDirectory: {eq: "friend"}}) {
      edges {
        node {
          relativePath
          name
          childImageSharp {
            fluid(maxWidth: 100) {
              ...GatsbyImageSharpFluid
            }
          }
        }
      }
    }
  }
`
