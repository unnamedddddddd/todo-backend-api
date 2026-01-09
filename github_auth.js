export const exchangeCodeForToken = async (code) => {
  const response = await fetch('https://github.com/login/oauth/access_token',{
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Accept': 'application/json'
    },
    body: JSON.stringify({ 
      code,
      client_id: process.env.ClIENT_ID_GITHUB,
      client_secret: process.env.CLIENT_SECRET_GITHUB,
    })
  })

  const tokenGitHub = await response.json();

  if (tokenGitHub.error) {
    throw new Error(`GitHub Auth error: ${tokenGitHub.error_description} `);
  }
  
  return tokenGitHub;
}

export const getUserInfoFromGithub = async (tokenGitHub) => {
  const response = await fetch('https://api.github.com/user', {
     headers: {
      'Authorization': `Bearer ${tokenGitHub}`,
      'Accept': 'application/json',
    },
  })
  const userGitHub = await response.json();
    
  if (userGitHub.message) { 
    throw new Error(`GitHub API error: ${userGitHub.message}`);
  }
  
  return userGitHub;
}